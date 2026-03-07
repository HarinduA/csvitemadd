using CsvItemAdder.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CsvItemAdder.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Item> Items { get; set; }
    public DbSet<UploadRecord> Uploads { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<UploadRecord>(entity =>
        {
            entity.ToTable("Uploads");
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<Item>(entity =>
        {
            entity.ToTable("Items");

            // Composite Primary Key: LocaCode + ItemCode
            entity.HasKey(e => new { e.LocaCode, e.ItemCode });

            entity.Property(e => e.Copcode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.LocaCode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ItemCode).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Qty1).HasColumnType("decimal(18,4)");
            entity.Property(e => e.Qty2).HasColumnType("decimal(18,4)");

            entity.HasOne(e => e.Upload)
                  .WithMany()
                  .HasForeignKey(e => e.UploadId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
