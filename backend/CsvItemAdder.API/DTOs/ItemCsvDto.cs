using CsvHelper.Configuration.Attributes;

namespace CsvItemAdder.API.DTOs;

public class ItemCsvDto
{
    [Name("copcode")]
    public string Copcode { get; set; } = string.Empty;

    [Name("loca_code")]
    public string LocaCode { get; set; } = string.Empty;

    [Name("item_code")]
    public string ItemCode { get; set; } = string.Empty;

    [Name("qty1")]
    public decimal Qty1 { get; set; }

    [Name("qty2")]
    public decimal Qty2 { get; set; }
}
