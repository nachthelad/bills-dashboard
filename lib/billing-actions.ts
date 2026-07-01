export async function toggleBillStatus(
  docId: string,
  currentStatus: string,
  token: string
): Promise<void> {
  const newStatus = currentStatus === "paid" ? "pending" : "paid";

  const response = await fetch(`/api/documents/${docId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: newStatus }),
  });

  if (!response.ok) {
    throw new Error("No se pudo actualizar la boleta");
  }
}
