/**
 * legal.ts
 * @description Interfaces for privacy, terms, and license content structures
 */

export interface IDettaglio {
  titolo?: string;
  icon?: string;
  nome: string;
  valore: string;
  textClass?: string; // Optional class for value text styling
}

export interface ITabSelezionati {
  name?: string;
  title?: string; // Some files use title
  label?: string; // Some files use label
  titolo?: string; // Some files use titolo
  clickable?: boolean;
  icon?: string;
  dettagli?: IDettaglio[];
}
