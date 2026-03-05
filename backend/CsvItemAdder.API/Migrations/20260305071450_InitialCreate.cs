using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CsvItemAdder.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Items",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    copcode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    loca_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    item_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    qty1 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    qty2 = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Items", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Items");
        }
    }
}
