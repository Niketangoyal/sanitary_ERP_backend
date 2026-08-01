import { prisma } from "../config/prisma";

export interface SearchResultItem {
  type: "customer" | "product" | "invoice";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

export const searchService = {
  async globalSearch(query: string): Promise<SearchResultItem[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const [customers, products, sales] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { mobile: { contains: q, mode: "insensitive" } },
            { gstNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.product.findMany({
        where: {
          OR: [
            { itemName: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.sale.findMany({
        where: { invoiceNumber: { contains: q, mode: "insensitive" } },
        include: { customer: true },
        take: 5,
      }),
    ]);

    const results: SearchResultItem[] = [
      ...customers.map((c) => ({
        type: "customer" as const,
        id: c.id,
        title: c.companyName,
        subtitle: `${c.mobile}${c.gstNumber ? ` · GST ${c.gstNumber}` : ""}`,
        link: `/customers/${c.id}`,
      })),
      ...products.map((p) => ({
        type: "product" as const,
        id: p.id,
        title: p.itemName,
        subtitle: [p.brand, p.category].filter(Boolean).join(" · ") || p.unit,
        link: `/products?highlight=${p.id}`,
      })),
      ...sales.map((s) => ({
        type: "invoice" as const,
        id: s.id,
        title: s.invoiceNumber,
        subtitle: `${s.customer.companyName} · ${s.invoiceDate.toISOString().slice(0, 10)}`,
        link: `/sales/${s.id}`,
      })),
    ];

    return results;
  },
};
