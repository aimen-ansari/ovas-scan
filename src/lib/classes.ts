// Output order is the exact order used in notebook cell 113.
export const CLASS_NAMES = ["complex_cyst", "dominant_follicle", "healthy", "poly_cyst", "simple_cyst"] as const;
export type ClassName = (typeof CLASS_NAMES)[number];
export const CLASS_INFO: Record<ClassName, { label: string; short: string; description: string; tone: string; count: number }> = {
  complex_cyst: { label: "Complex cyst", short: "Class 01", description: "The complex_cyst label in the research dataset.", tone: "#b65b78", count: 1368 },
  dominant_follicle: { label: "Dominant follicle", short: "Class 02", description: "The dominant_follicle label in the research dataset.", tone: "#9b82bc", count: 1296 },
  healthy: { label: "Healthy", short: "Class 03", description: "The healthy label in the research dataset; a model label does not establish health status.", tone: "#468b7b", count: 1464 },
  poly_cyst: { label: "Poly cyst", short: "Class 04", description: "The poly_cyst label in the research dataset; this output alone does not diagnose PCOS.", tone: "#cf9961", count: 1422 },
  simple_cyst: { label: "Simple cyst", short: "Class 05", description: "The simple_cyst label in the research dataset.", tone: "#6c85b3", count: 1326 },
};
export function asClass(value: string): ClassName | undefined {
  const normalized = value.toLowerCase().replaceAll(" ", "_");
  return CLASS_NAMES.find(c => c === normalized);
}
