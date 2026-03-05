using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CsvItemAdder.API.Models;

[Table("Items")]
public class Item
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("copcode")]
    public string Copcode { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("loca_code")]
    public string LocaCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("item_code")]
    public string ItemCode { get; set; } = string.Empty;

    [Column("qty1")]
    public decimal Qty1 { get; set; }

    [Column("qty2")]
    public decimal Qty2 { get; set; }
}
