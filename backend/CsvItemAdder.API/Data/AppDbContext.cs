using CsvItemAdder.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CsvItemAdder.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Item> Items { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Item>(entity =>
        {
            entity.ToTable("Items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Copcode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.LocaCode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ItemCode).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Qty1).HasColumnType("decimal(18,4)");
            entity.Property(e => e.Qty2).HasColumnType("decimal(18,4)");
        });
    }
}
