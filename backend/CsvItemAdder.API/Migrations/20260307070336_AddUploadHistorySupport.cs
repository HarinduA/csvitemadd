using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CsvItemAdder.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUploadHistorySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "upload_id",
                table: "Items",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Uploads",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    UploadDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalRows = table.Column<int>(type: "int", nullable: false),
                    SavedRows = table.Column<int>(type: "int", nullable: false),
                    DuplicateRows = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Uploads", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Items_upload_id",
                table: "Items",
                column: "upload_id");

            migrationBuilder.AddForeignKey(
                name: "FK_Items_Uploads_upload_id",
                table: "Items",
                column: "upload_id",
                principalTable: "Uploads",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Items_Uploads_upload_id",
                table: "Items");

            migrationBuilder.DropTable(
                name: "Uploads");

            migrationBuilder.DropIndex(
                name: "IX_Items_upload_id",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "upload_id",
                table: "Items");
        }
    }
}
