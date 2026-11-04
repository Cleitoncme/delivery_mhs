import { expect, test } from "@playwright/test";
test("busca e categorias", async ({ page }) => {
  await page.goto("/");
  const products = page.locator(".product-card");
  await expect(products.first()).toBeVisible({ timeout: 30000 });
  const productCount = await products.count();
  expect(productCount).toBeGreaterThan(0);
  await expect(page.locator(".product-card .add-symbol")).toHaveCount(
    productCount,
  );
  await page.getByRole("searchbox", { name: "Buscar produtos" }).fill("coca");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page
    .getByRole("navigation", { name: "Categorias", exact: true })
    .getByRole("link", { name: "Bebidas" })
    .click();
  await page.getByRole("button", { name: "Águas", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Água Mineral 500ml" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
