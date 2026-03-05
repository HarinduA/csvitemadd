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
    /// Upload a CSV file and bulk insert items into the database.
    /// Skips rows where (loca_code + item_code) already exist (DB or within the CSV itself).
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

        var parsedItems = new List<Item>();
        var errors = new List<string>();

        // ── 1. Parse CSV ────────────────────────────────────────────────────
        try
        {
            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = true,
                MissingFieldFound = null,
                HeaderValidated = null,
                BadDataFound = context =>
                {
                    errors.Add($"Row {context.RawRecord}: Bad data found.");
                }
            };

            using var stream = file.OpenReadStream();
            using var reader = new StreamReader(stream);
            using var csv = new CsvReader(reader, config);

            var records = csv.GetRecords<ItemCsvDto>().ToList();

            foreach (var record in records)
            {
                parsedItems.Add(new Item
                {
                    Copcode = record.Copcode?.Trim() ?? string.Empty,
                    LocaCode = record.LocaCode?.Trim() ?? string.Empty,
                    ItemCode = record.ItemCode?.Trim() ?? string.Empty,
                    Qty1 = record.Qty1,
                    Qty2 = record.Qty2
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing CSV file.");
            return BadRequest(new { message = $"Error parsing CSV: {ex.Message}" });
        }

        if (parsedItems.Count == 0)
            return BadRequest(new { message = "No valid rows found in CSV." });

        // ── 2. Deduplicate within the CSV (keep first occurrence) ───────────
        var seenInCsv = new HashSet<(string, string)>();
        var uniqueItems = new List<Item>();
        var csvDuplicateCount = 0;

        foreach (var item in parsedItems)
        {
            var key = (item.LocaCode, item.ItemCode);
            if (!seenInCsv.Add(key))
            {
                errors.Add($"Duplicate in CSV – loca_code='{item.LocaCode}', item_code='{item.ItemCode}' (skipped).");
                csvDuplicateCount++;
            }
            else
            {
                uniqueItems.Add(item);
            }
        }

        // ── 3. Check against existing DB rows ───────────────────────────────
        // Collect all (loca_code, item_code) pairs from the DB that match any incoming key
        var incomingLocaCodes = uniqueItems.Select(i => i.LocaCode).Distinct().ToList();
        var incomingItemCodes = uniqueItems.Select(i => i.ItemCode).Distinct().ToList();

        var existingKeys = await _context.Items
            .Where(x => incomingLocaCodes.Contains(x.LocaCode) && incomingItemCodes.Contains(x.ItemCode))
            .Select(x => new { x.LocaCode, x.ItemCode })
            .ToListAsync();

        var existingSet = existingKeys
            .Select(x => (x.LocaCode, x.ItemCode))
            .ToHashSet();

        var newItems = new List<Item>();
        var dbDuplicateCount = 0;

        foreach (var item in uniqueItems)
        {
            if (existingSet.Contains((item.LocaCode, item.ItemCode)))
            {
                errors.Add($"Already exists in DB – loca_code='{item.LocaCode}', item_code='{item.ItemCode}' (skipped).");
                dbDuplicateCount++;
            }
            else
            {
                newItems.Add(item);
            }
        }

        if (newItems.Count == 0)
        {
            return Ok(new
            {
                message = "No new items to import – all rows were duplicates.",
                totalRows = parsedItems.Count,
                savedRows = 0,
                csvDuplicatesSkipped = csvDuplicateCount,
                dbDuplicatesSkipped = dbDuplicateCount,
                errors
            });
        }

        // ── 4. Bulk insert new items in batches ─────────────────────────────
        try
        {
            const int batchSize = 1000;
            int totalSaved = 0;

            for (int i = 0; i < newItems.Count; i += batchSize)
            {
                var batch = newItems.Skip(i).Take(batchSize).ToList();
                await _context.Items.AddRangeAsync(batch);
                await _context.SaveChangesAsync();
                totalSaved += batch.Count;
                _logger.LogInformation("Saved batch {Batch}, total so far: {Total}", i / batchSize + 1, totalSaved);
            }

            return Ok(new
            {
                message = $"Successfully imported {totalSaved} item(s).",
                totalRows = parsedItems.Count,
                savedRows = totalSaved,
                csvDuplicatesSkipped = csvDuplicateCount,
                dbDuplicatesSkipped = dbDuplicateCount,
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
        [FromQuery] string? search = null)
    {
        var query = _context.Items.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Copcode.Contains(search) ||
                x.LocaCode.Contains(search) ||
                x.ItemCode.Contains(search));
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
    /// Delete all items from the table.
    /// </summary>
    [HttpDelete("clear")]
    public async Task<IActionResult> ClearAll()
    {
        await _context.Database.ExecuteSqlRawAsync("DELETE FROM Items");
        return Ok(new { message = "All items deleted." });
    }
}
