import { describe, expect, it } from 'vitest';

import { decideEvidenceGeography } from '../src/modules/research/stages/04-company-profiling/company-profiling.geography';

const TARGET = 'Lithuania';

function decision(
  quote: string,
  options: {
    channel?: 'delivery' | 'pickup' | 'purchase';
    direction?: 'allows' | 'restricts';
    sourceText?: string;
    sourceUrl?: string;
  } = {},
) {
  return decideEvidenceGeography({
    channel: options.channel ?? 'delivery',
    direction: options.direction ?? 'allows',
    quote,
    sourceText: options.sourceText ?? quote,
    sourceUrl: options.sourceUrl ?? 'https://pvz.lt/saltinis',
    targetCountry: TARGET,
  });
}

describe('decideEvidenceGeography', () => {
  it('rejects a foreign-only delivery allow', () => {
    const result = decision('Pristatome visoje Latvijoje.');

    expect(result.supported).toBe(false);
    expect(result.detail).toContain('another country');
  });

  it('keeps an explicit foreign-only delivery restriction', () => {
    expect(
      decision('Pristatome tik Latvijoje.', {
        direction: 'restricts',
      }).supported,
    ).toBe(true);
  });

  it('keeps a delivery allow that names both the foreign country and Lithuania', () => {
    expect(
      decision('Pristatome Latvijoje ir Lietuvoje.').supported,
    ).toBe(true);
  });

  it('keeps an EU-wide delivery allow', () => {
    expect(decision('Pristatome į visas ES šalis.').supported).toBe(true);
  });

  it('rejects a pickup allow with no location', () => {
    const result = decision('Atsiimkite parduotuvėje.', {
      channel: 'pickup',
      sourceText: 'Atsiimkite parduotuvėje.',
      sourceUrl: 'https://pvz.lt/kontaktai',
    });

    expect(result.supported).toBe(false);
    expect(result.detail).toContain('Pickup location');
  });

  it('keeps a pickup allow tied to Vilnius in the same Lithuanian source', () => {
    expect(
      decision('Atsiimkite parduotuvėje.', {
        channel: 'pickup',
        sourceText: 'Atsiimkite parduotuvėje Vilniuje.',
        sourceUrl: 'https://pvz.lt/kontaktai',
      }).supported,
    ).toBe(true);
  });

  it('rejects a pickup allow tied to a foreign city and domain', () => {
    expect(
      decision('Atsiimkite parduotuvėje.', {
        channel: 'pickup',
        sourceText: 'Atsiimkite parduotuvėje Rygoje.',
        sourceUrl: 'https://pvz.lv/kontaktai',
      }).supported,
    ).toBe(false);
  });

  it('keeps a pickup allow when the source names Vilnius and Lithuania', () => {
    expect(
      decision('Atsiimkite parduotuvėje.', {
        channel: 'pickup',
        sourceText: 'Parduotuvė Vilniuje, Lietuva.',
        sourceUrl: 'https://pvz.com/kontaktai',
      }).supported,
    ).toBe(true);
  });

  it('keeps a delivery allow with no place as unknown', () => {
    const result = decision('Prekes pristatome per 1-2 d.d.');

    expect(result.effect).toBe('unknown');
    expect(result.supported).toBe(false);
  });

  it('treats "not to Lithuania" as a delivery denial', () => {
    const result = decision('Į Lietuvą nepristatome.', {
      direction: 'restricts',
    });

    expect(result.effect).toBe('deny');
    expect(result.supported).toBe(true);
  });

  it('treats "not to Latvia" as unknown for Lithuania', () => {
    const result = decision('Į Latviją nepristatome.', {
      direction: 'restricts',
    });

    expect(result.effect).toBe('unknown');
  });

  it('treats "only in Latvia" as a delivery denial', () => {
    expect(
      decision('Pristatome tik Latvijoje.', {
        direction: 'restricts',
      }).effect,
    ).toBe('deny');
  });

  it('treats an EU-wide allow that excludes Lithuania as a denial', () => {
    expect(
      decision('Pristatome visoje ES, išskyrus Lietuvą.', {
        direction: 'allows',
      }).effect,
    ).toBe('deny');
  });

  it('does not accept a registration address as a pickup location', () => {
    expect(
      decision('Atsiimkite parduotuvėje.', {
        channel: 'pickup',
        sourceText: 'Registracijos adresas: Vilnius, Lietuva.',
        sourceUrl: 'https://pvz.lt/kontaktai',
      }).effect,
    ).toBe('unknown');
  });

  it('accepts the stronger medziosandelis quote for a b offer', () => {
    expect(
      decision('Greitas pristatymas visoje Lietuvoje', {
        sourceUrl:
          'https://medziosandelis.eu/product/termo-lauko-dailylentes/',
      }).effect,
    ).toBe('allow');
  });

  it('keeps the same medziosandelis weak quote unknown', () => {
    expect(
      decision('Prekes pristatome per 1-2 d.d', {
        sourceUrl:
          'https://medziosandelis.eu/product/termo-lauko-dailylentes/',
      }).effect,
    ).toBe('unknown');
  });

  it('rejects the Polish-only delivery allow from alga-wood', () => {
    expect(
      decision('Dostawa drewna na terenie całej Polski', {
        sourceUrl: 'https://alga-wood.com/produkt/termo-abachi',
      }).supported,
    ).toBe(false);
  });

  it('keeps the Lithuanian delivery allow even when a foreign list is present', () => {
    expect(
      decision(
        'Pristatymas visoje Lietuvoje. Pristatymas užsienyje – į Latviją, Estiją, Lenkiją.',
      ).supported,
    ).toBe(true);
  });

  it('keeps a worldwide delivery allow', () => {
    expect(
      decision(
        'Prekes siunčiame į visas pasaulio šalis.',
        { sourceUrl: 'https://pirtiesprekes.lt/produktas' },
      ).supported,
    ).toBe(true);
  });

  it('rejects a foreign-only purchase allow but keeps a foreign purchase restriction', () => {
    expect(
      decision('Parduodame visoje Latvijoje.', {
        channel: 'purchase',
      }).supported,
    ).toBe(false);

    expect(
      decision('Parduodame tik Latvijoje.', {
        channel: 'purchase',
        direction: 'restricts',
      }).supported,
    ).toBe(true);
  });

  it('rejects the Siguldas pickup allow without a Lithuanian store location', () => {
    expect(
      decision('vari izņemt preci veikalā pats', {
        channel: 'pickup',
        sourceText:
          'Siguldas Kokmateriāli. Veicam piegādi visā Latvijā. vari izņemt preci veikalā pats',
        sourceUrl: 'https://www.siguldaskokmateriali.lv/kontaktinformacija',
      }).supported,
    ).toBe(false);
  });
});
