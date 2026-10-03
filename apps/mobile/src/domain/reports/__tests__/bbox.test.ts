import { regionToBbox, snapBbox } from "@/domain/reports/bbox";

describe("regionToBbox", () => {
  it("spans half the delta on each side of the center", () => {
    expect(regionToBbox({ latitude: 19.4, longitude: -99.1, latitudeDelta: 0.2, longitudeDelta: 0.4 })).toEqual({
      minLng: expect.closeTo(-99.3),
      minLat: expect.closeTo(19.3),
      maxLng: expect.closeTo(-98.9),
      maxLat: expect.closeTo(19.5),
    });
  });

  it("stays on the globe when zoomed out past it", () => {
    expect(regionToBbox({ latitude: 80, longitude: 170, latitudeDelta: 40, longitudeDelta: 40 })).toEqual({
      minLng: 150,
      minLat: 60,
      maxLng: 180,
      maxLat: 90,
    });
  });
});

describe("snapBbox", () => {
  const box = { minLng: -99.1834, minLat: 19.3812, maxLng: -99.0712, maxLat: 19.4877 };

  it("only ever grows the box", () => {
    const snapped = snapBbox(box);
    expect(snapped.minLng).toBeLessThanOrEqual(box.minLng);
    expect(snapped.minLat).toBeLessThanOrEqual(box.minLat);
    expect(snapped.maxLng).toBeGreaterThanOrEqual(box.maxLng);
    expect(snapped.maxLat).toBeGreaterThanOrEqual(box.maxLat);
  });

  it("gives the same key for a small pan within the same cells", () => {
    const nudged = { minLng: box.minLng + 0.002, minLat: box.minLat + 0.002, maxLng: box.maxLng + 0.002, maxLat: box.maxLat + 0.002 };
    expect(snapBbox(nudged)).toEqual(snapBbox(box));
  });

  it("uses a grid proportional to the zoom level", () => {
    const city = snapBbox(box);
    const country = snapBbox({ minLng: -117.1, minLat: 14.5, maxLng: -86.7, maxLat: 32.7 });
    expect(city.maxLng - city.minLng).toBeLessThan(1);
    expect(country.maxLng - country.minLng).toBeGreaterThan(30);
  });

  it("produces round numbers, so float noise can't split one cell into two keys", () => {
    const snapped = snapBbox(box);
    for (const value of Object.values(snapped)) {
      expect(value).toBe(+value.toFixed(6));
    }
  });

  it("copes with a degenerate box", () => {
    const point = { minLng: -99.1, minLat: 19.4, maxLng: -99.1, maxLat: 19.4 };
    const snapped = snapBbox(point);
    expect(snapped.minLng).toBeLessThanOrEqual(-99.1);
    expect(snapped.maxLat).toBeGreaterThanOrEqual(19.4);
  });
});
