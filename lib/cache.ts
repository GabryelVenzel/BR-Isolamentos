// Cache em memória, com TTL, para dados que mudam pouco (materiais, acabamentos,
// config da empresa, preços) e são lidos com frequência (ex.: toda vez que o
// wizard de orçamento abre o step-2/step-4).
//
// Limitação conhecida: é por instância de processo — em serverless (Vercel) cada
// invocação "fria" começa com cache vazio, e instâncias diferentes não
// compartilham cache entre si. Isso é aceitável para o volume atual (reduz carga
// repetida dentro de uma mesma instância "quente"), mas se o acesso concorrente
// crescer, trocar por Vercel KV (Redis) mantendo a mesma interface `getOrSet`.

interface CacheEntry<T> {
  valor: T;
  expiraEm: number;
}

const CACHE_TTL_PADRAO_MS = 5 * 60 * 1000; // 5 minutos

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(chave: string): T | undefined {
    const entry = this.store.get(chave);
    if (!entry) return undefined;
    if (Date.now() > entry.expiraEm) {
      this.store.delete(chave);
      return undefined;
    }
    return entry.valor as T;
  }

  set<T>(chave: string, valor: T, ttlMs = CACHE_TTL_PADRAO_MS): void {
    this.store.set(chave, { valor, expiraEm: Date.now() + ttlMs });
  }

  delete(chave: string): void {
    this.store.delete(chave);
  }

  /** Remove todas as entradas cuja chave começa com o prefixo — útil para invalidar
   * um grupo relacionado (ex.: `invalidatePrefix("precos:")` após salvar preços). */
  invalidatePrefix(prefixo: string): void {
    for (const chave of this.store.keys()) {
      if (chave.startsWith(prefixo)) this.store.delete(chave);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new MemoryCache();

/** Busca `chave` no cache; se ausente/expirada, executa `fetcher`, guarda o
 * resultado e o retorna. Uso:
 *
 *   const materiais = await getOrSet("materiais:ativos", () => materialRepo.findAll(), 10 * 60 * 1000);
 */
export async function getOrSet<T>(
  chave: string,
  fetcher: () => Promise<T>,
  ttlMs = CACHE_TTL_PADRAO_MS
): Promise<T> {
  const cacheado = cache.get<T>(chave);
  if (cacheado !== undefined) return cacheado;

  const valor = await fetcher();
  cache.set(chave, valor, ttlMs);
  return valor;
}
