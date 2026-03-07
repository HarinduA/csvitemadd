using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CsvItemAdder.API.Models;

[Table("Uploads")]
public class UploadRecord
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    public DateTime UploadDate { get; set; } = DateTime.UtcNow;

    public int TotalRows { get; set; }

    public int SavedRows { get; set; }

    public int DuplicateRows { get; set; }
}
