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

        var items = new List<Item>();
        var errors = new List<string>();

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
                items.Add(new Item
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

        if (items.Count == 0)
            return BadRequest(new { message = "No valid rows found in CSV." });

        try
        {
            // Bulk insert in batches of 1000 for performance
            const int batchSize = 1000;
            int totalSaved = 0;

            for (int i = 0; i < items.Count; i += batchSize)
            {
                var batch = items.Skip(i).Take(batchSize).ToList();
                await _context.Items.AddRangeAsync(batch);
                await _context.SaveChangesAsync();
                totalSaved += batch.Count;
                _logger.LogInformation("Saved batch {Batch}, total so far: {Total}", i / batchSize + 1, totalSaved);
            }

            return Ok(new
            {
                message = $"Successfully imported {totalSaved} items.",
                totalRows = items.Count,
                savedRows = totalSaved,
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
            .OrderBy(x => x.Id)
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
