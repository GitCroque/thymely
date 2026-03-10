export function parsePagination(query: { page?: string; limit?: string }) {
  const rawLimit = Number(query.limit);
  const rawPage = Number(query.page);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) && query.limit !== "" ? rawLimit : 50, 1),
    100
  );
  const page = Math.max(
    Number.isFinite(rawPage) && query.page !== "" ? rawPage : 1,
    1
  );
  return { skip: (page - 1) * limit, take: limit, page, limit };
}
