using CsvHelper;
using CsvHelper.Configuration;
using CsvItemAdder.API.Data;
using CsvItemAdder.API.DTOs;
using CsvItemAdder.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace CsvItemAdder.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ItemsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<ItemsController> _logger;

    public ItemsController(AppDbContext context, ILogger<ItemsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Upload a CSV file, track the upload in history, and upsert items.
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB max
    public async Task<IActionResult> UploadCsv(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".csv")
            return BadRequest(new { message = "Only CSV files are accepted." });

        var errors = new List<string>();
        var parsedDtos = new List<ItemCsvDto>();

        // ── 1. Create Upload Record ─────────────────────────────────────
        var upload = new UploadRecord
        {
            FileName = file.FileName,
            UploadDate = DateTime.UtcNow
        };
        _context.Uploads.Add(upload);
        await _context.SaveChangesAsync(); // Save to get Id

        // ── 2. Parse CSV ────────────────────────────────────────────────
        try
        {
            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = true,
                MissingFieldFound = null,
                HeaderValidated = null,
                PrepareHeaderForMatch = args => args.Header.Trim().ToLower(), // Case-insensitive and trimmed headers
            };

            using var stream = file.OpenReadStream();
            using var reader = new StreamReader(stream);
            using var csv = new CsvReader(reader, config);

            // Robust Header Discovery: skip until we find "Item Code"
            bool foundHeader = false;
            while (await csv.ReadAsync())
            {
                for (int i = 0; i < csv.Parser.Count; i++)
                {
                    var field = csv.GetField(i);
                    if (field != null && field.Contains("Item Code", StringComparison.OrdinalIgnoreCase))
                    {
                        csv.ReadHeader();
                        foundHeader = true;
                        break;
                    }
                }
                if (foundHeader) break;
            }

            if (!foundHeader)
            {
                _context.Uploads.Remove(upload);
                await _context.SaveChangesAsync();
                return BadRequest(new { message = "Could not find a valid header row containing 'Item Code'." });
            }

            parsedDtos = csv.GetRecords<ItemCsvDto>().ToList();
            _logger.LogInformation("Parsed {Count} records from CSV.", parsedDtos.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing CSV file.");
            _context.Uploads.Remove(upload);
            await _context.SaveChangesAsync();
            return BadRequest(new { message = $"Error parsing CSV: {ex.Message}" });
        }

        if (parsedDtos.Count == 0)
        {
            _context.Uploads.Remove(upload);
            await _context.SaveChangesAsync();
            return BadRequest(new { message = "No valid rows found in CSV." });
        }

        // ── 3. Upsert into DB ───────────────────────────────────────────
        int savedCount = 0;
        int duplicateCount = 0;

        try
        {
            // Process in batches for performance
            const int batchSize = 500;
            for (int i = 0; i < parsedDtos.Count; i += batchSize)
            {
                var batch = parsedDtos.Skip(i).Take(batchSize).ToList();
                var locaCodes = batch.Select(x => x.LocaCode).Distinct().ToList();
                var itemCodes = batch.Select(x => x.ItemCode).Distinct().ToList();

                // Fetch existing items for this batch
                var existingItems = await _context.Items
                    .Where(x => locaCodes.Contains(x.LocaCode) && itemCodes.Contains(x.ItemCode))
                    .ToListAsync();

                var newItems = new List<Item>();

                foreach (var dto in batch)
                {
                    if (string.IsNullOrWhiteSpace(dto.ItemCode) || string.IsNullOrWhiteSpace(dto.LocaCode))
                    {
                        duplicateCount++;
                        continue;
                    }

                    var existing = existingItems.FirstOrDefault(x => 
                        x.LocaCode.Equals(dto.LocaCode, StringComparison.OrdinalIgnoreCase) && 
                        x.ItemCode.Equals(dto.ItemCode, StringComparison.OrdinalIgnoreCase));

                    if (existing != null)
                    {
                        // Update existing
                        existing.Copcode = dto.Copcode ?? string.Empty;
                        existing.Description = dto.Description;
                        existing.Qty1 = dto.Qty1;
                        existing.Qty2 = dto.Qty2;
                        existing.UploadId = upload.Id;
                    }
                    else
                    {
                        // Add new
                        newItems.Add(new Item
                        {
                            Copcode = dto.Copcode ?? string.Empty,
                            LocaCode = dto.LocaCode,
                            ItemCode = dto.ItemCode,
                            Description = dto.Description,
                            Qty1 = dto.Qty1,
                            Qty2 = dto.Qty2,
                            UploadId = upload.Id
                        });
                    }
                    savedCount++;
                }

                if (newItems.Any())
                {
                    await _context.Items.AddRangeAsync(newItems);
                }
                
                await _context.SaveChangesAsync();
            }

            // Finalize upload record
            upload.TotalRows = parsedDtos.Count;
            upload.SavedRows = savedCount;
            upload.DuplicateRows = duplicateCount;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Successfully processed {savedCount} item(s).",
                uploadId = upload.Id,
                totalRows = parsedDtos.Count,
                savedRows = savedCount,
                errors
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving items to database.");
            return StatusCode(500, new { message = $"Database error: {ex.Message}" });
        }
    }

    /// <summary>
    /// Get paginated list of items.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetItems(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] int? uploadId = null)
    {
        var query = _context.Items.AsQueryable();

        if (uploadId.HasValue)
        {
            query = query.Where(x => x.UploadId == uploadId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Copcode.Contains(search) ||
                x.LocaCode.Contains(search) ||
                x.ItemCode.Contains(search) ||
                (x.Description != null && x.Description.Contains(search)));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(x => x.LocaCode)
            .ThenBy(x => x.ItemCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            total,
            page,
            pageSize,
            items
        });
    }

    /// <summary>
    /// Get upload history.
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetUploadHistory()
    {
        var history = await _context.Uploads
            .OrderByDescending(x => x.UploadDate)
            .ToListAsync();
        return Ok(history);
    }

    /// <summary>
    /// Delete an upload and all its associated items (or just clear the link).
    /// </summary>
    [HttpDelete("history/{id}")]
    public async Task<IActionResult> DeleteHistory(int id)
    {
        var upload = await _context.Uploads.FindAsync(id);
        if (upload == null) return NotFound();

        // Optional: Decide whether to delete items or just clear their UploadId
        // For now, let's keep items but clear the history entry
        _context.Uploads.Remove(upload);
        await _context.SaveChangesAsync();
        return Ok(new { message = "History entry removed." });
    }

    [HttpDelete("clear")]
    public async Task<IActionResult> ClearAll()
    {
        await _context.Database.ExecuteSqlRawAsync("DELETE FROM Items");
        await _context.Database.ExecuteSqlRawAsync("DELETE FROM Uploads");
        return Ok(new { message = "All items and history entries deleted." });
    }
}

public class KeyTupleComparer : IEqualityComparer<(string, string)>
{
    public bool Equals((string, string) x, (string, string) y)
    {
        return string.Equals(x.Item1, y.Item1, StringComparison.OrdinalIgnoreCase) &&
               string.Equals(x.Item2, y.Item2, StringComparison.OrdinalIgnoreCase);
    }

    public int GetHashCode((string, string) obj)
    {
        return HashCode.Combine(
            obj.Item1?.ToLowerInvariant() ?? "",
            obj.Item2?.ToLowerInvariant() ?? ""
        );
    }
}
