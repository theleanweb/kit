export const rules = [
  {
    tag: "img",
    attribute: "src",
    type: "src",
  },

  {
    tag: "img",
    attribute: "srcset",
    type: "srcset",
  },

  {
    tag: "input",
    attribute: "src",
    type: "src",
  },

  {
    tag: "audio",
    attribute: "src",
    type: "src",
  },

  {
    tag: "video",
    attribute: "src",
    type: "src",
  },

  {
    tag: "video",
    attribute: "poster",
    type: "src",
  },

  {
    tag: "source",
    attribute: "src",
    type: "src",
  },

  {
    tag: "source",
    attribute: "srcset",
    type: "srcset",
  },

  {
    tag: "track",
    attribute: "src",
    type: "src",
  },

  {
    tag: "link",
    attribute: "href",
    type: "src",
  },

  {
    tag: "script",
    attribute: "src",
    type: "src",
  },

  {
    tag: "object",
    attribute: "data",
    type: "src",
  },

  {
    tag: "embed",
    attribute: "src",
    type: "src",
  },
] as const;

export type Rule = (typeof rules)[number];
export type Tags = (typeof rules)[number]["tag"];
