import type { Locator } from "@playwright/test";

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(value: string): Rgba {
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
  const [r = 0, g = 0, b = 0, a = 1] = numbers;
  return { r, g, b, a: numbers.length > 3 ? a : 1 };
}

function over(top: Rgba, bottom: Rgba): Rgba {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(first: Rgba, second: Rgba) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

async function textContrast(text: Locator) {
  const [color, background] = await text.evaluate((node) => {
    let element: Element | null = node;
    let background = "rgba(0, 0, 0, 0)";
    while (element) {
      const value = getComputedStyle(element).backgroundColor;
      if (!/rgba\(.*,\s*0\)$/.test(value) && value !== "transparent") {
        background = value;
        break;
      }
      element = element.parentElement;
    }
    return [getComputedStyle(node).color, background];
  });
  return contrast(parseColor(color), parseColor(background));
}

export { contrast, luminance, over, parseColor, textContrast };
export type { Rgba };
