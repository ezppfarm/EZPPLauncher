const specialOrder = "'-!#$%&(),;@[]^_`{}~+=";

const priority = Object.fromEntries([...specialOrder].map((c, i) => [c, i]));

const osuSkinsCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export const sortSkins = (
  skins: { name: string; author: string | undefined; modified: number }[]
) =>
  skins.sort((a, b) => {
    const pa = priority[a.name[0]];
    const pb = priority[b.name[0]];

    if (pa !== undefined || pb !== undefined) {
      if (pa === undefined) return 1;
      if (pb === undefined) return -1;
      return pa - pb;
    }

    return osuSkinsCollator.compare(a.name, b.name);
  });
