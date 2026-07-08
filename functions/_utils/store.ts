/**
 * In-memory data store — drop-in replacement for Google Sheets.
 * Mirrors the Python InMemoryRepository from sheets/repositories/memory.py
 */

export class InMemoryStore {
  private records: Record<string, any[]> = {};
  private idCounters: Record<string, number> = {};

  private generateId(collection: string): string {
    if (!this.idCounters[collection]) {
      this.idCounters[collection] = 0;
    }
    this.idCounters[collection]++;
    const now = Date.now();
    return `mem_${now}_${this.idCounters[collection]}`;
  }

  getAll(collection: string): any[] {
    return [...(this.records[collection] || [])];
  }

  getById(collection: string, id: string, idField: string = 'id'): any | null {
    const items = this.records[collection] || [];
    for (const item of items) {
      if (String(item[idField]) === id) {
        return { ...item };
      }
    }
    return null;
  }

  create(collection: string, data: Record<string, any>, headers: string[]): any {
    if (!this.records[collection]) {
      this.records[collection] = [];
    }

    const record: Record<string, string> = {};
    for (const h of headers) {
      record[h] = data[h] !== undefined ? String(data[h]) : '';
    }

    if (!record.id) {
      record.id = this.generateId(collection);
    }
    if (!record.created_at) {
      record.created_at = new Date().toISOString();
    }

    this.records[collection].push(record);
    return { ...record };
  }

  update(collection: string, id: string, data: Record<string, any>, idField: string = 'id'): boolean {
    const items = this.records[collection] || [];
    for (let i = 0; i < items.length; i++) {
      if (String(items[i][idField]) === id) {
        for (const [key, value] of Object.entries(data)) {
          if (key in items[i]) {
            items[i][key] = String(value);
          }
        }
        return true;
      }
    }
    return false;
  }

  delete(collection: string, id: string, idField: string = 'id'): boolean {
    const items = this.records[collection] || [];
    const firstItem = items[0];
    if (firstItem && 'is_active' in firstItem) {
      return this.update(collection, id, { is_active: 'false' }, idField);
    }
    for (let i = 0; i < items.length; i++) {
      if (String(items[i][idField]) === id) {
        this.records[collection].splice(i, 1);
        return true;
      }
    }
    return false;
  }

  find(collection: string, filters: Record<string, any>): any[] {
    const items = this.records[collection] || [];
    return items.filter((record) => {
      for (const [key, value] of Object.entries(filters)) {
        if (String(record[key] ?? '') !== String(value)) {
          return false;
        }
      }
      return true;
    }).map((r) => ({ ...r }));
  }

  clear(collection?: string): void {
    if (collection) {
      delete this.records[collection];
      delete this.idCounters[collection];
    } else {
      this.records = {};
      this.idCounters = {};
    }
  }
}

// Singleton instance
export const store = new InMemoryStore();
