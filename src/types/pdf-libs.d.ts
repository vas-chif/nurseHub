import type { jsPDF } from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
  }
}

declare module 'jspdf-autotable' {
  export default function autoTable(doc: jsPDF, options: unknown): void;
}
