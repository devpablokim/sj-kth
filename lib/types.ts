export type Row = Record<string, unknown>;

export interface Dataset {
  fileName: string;
  loadedAt: string | null;
  sheets: Record<string, Row[]>;
}
