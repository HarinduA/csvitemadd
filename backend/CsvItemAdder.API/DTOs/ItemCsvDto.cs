using CsvHelper.Configuration.Attributes;

namespace CsvItemAdder.API.DTOs;

public class ItemCsvDto
{
    [Name("compcode", "copcode", "comp code")]
    public string Copcode { get; set; } = "DEFAULT";

    [Name("loca_code", "location", "loca")]
    public string LocaCode { get; set; } = "DEFAULT";

    [Name("item code", "item_code", "itemcode")]
    public string ItemCode { get; set; } = string.Empty;

    [Name("item description", "description", "item_description")]
    public string? Description { get; set; }

    [Name("bulk", "qty1")]
    public decimal Qty1 { get; set; }

    [Name("loose", "qty2")]
    public decimal Qty2 { get; set; }
}
