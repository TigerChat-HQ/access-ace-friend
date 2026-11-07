export function locationMessage(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid location");
  return `📍 Location\nhttps://www.google.com/maps?q=${latitude},${longitude}`;
}
export function contactMessage(name: string, phone: string) {
  const cleanPhone = phone.replace(/[\s()-]/g, "");
  if (!name.trim() || !/^\+?\d{5,15}$/.test(cleanPhone)) throw new Error("Enter a name and valid phone number.");
  return `👤 Contact: ${name.trim()}\n${cleanPhone}`;
}