import { defineBoot } from '#q-app/wrappers';
import { createI18n } from 'vue-i18n';

import messages from 'src/i18n';

export type MessageLanguages = keyof typeof messages;
// Type-define 'en-US' as the master schema for the resource
export type MessageSchema = (typeof messages)['en-US'];

// See https://vue-i18n.intlify.dev/guide/advanced/typescript.html#global-resource-schema-type-definition
// Augment vue-i18n module to enable type-safe translations.
// DefineDateTimeFormat and DefineNumberFormat are intentionally omitted (no custom formats needed).
declare module 'vue-i18n' {
  // extends MessageSchema is NOT empty — no-empty-object-type rule does not apply here.
  export interface DefineLocaleMessage extends MessageSchema {}
}

export default defineBoot(({ app }) => {
  const i18n = createI18n<{ message: MessageSchema }, MessageLanguages>({
    locale: 'en-US',
    legacy: false,
    messages,
  });

  // Set i18n instance on app
  app.use(i18n);
});
