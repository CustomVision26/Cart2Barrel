/**
 * Airlines that operate passenger service in the United States
 * (US majors, regionals marketed under majors, and foreign carriers with US routes).
 */
export const US_OPERATING_AIRLINES = [
  "Alaska Airlines",
  "Allegiant Air",
  "American Airlines",
  "Avelo Airlines",
  "Breeze Airways",
  "Delta Air Lines",
  "Frontier Airlines",
  "Hawaiian Airlines",
  "JetBlue",
  "Southwest Airlines",
  "Spirit Airlines",
  "Sun Country Airlines",
  "United Airlines",
  "Air Canada",
  "Air France",
  "Aeroméxico",
  "Avianca",
  "British Airways",
  "Caribbean Airlines",
  "Copa Airlines",
  "Emirates",
  "Iberia",
  "KLM",
  "Lufthansa",
  "Qatar Airways",
  "Turkish Airlines",
  "Virgin Atlantic",
  "WestJet",
] as const;

export type UsOperatingAirline = (typeof US_OPERATING_AIRLINES)[number];

export function isUsOperatingAirline(name: string): boolean {
  return (US_OPERATING_AIRLINES as readonly string[]).includes(name.trim());
}
