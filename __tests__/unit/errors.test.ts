import { AppError, ConflictError, NotFoundError, toHttpError, ValidationError } from "@/lib/errors";

describe("toHttpError", () => {
  it("erros AppError preservam mensagem e statusCode originais", () => {
    expect(toHttpError(new NotFoundError("Lead não encontrado."))).toEqual({
      message: "Lead não encontrado.",
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(toHttpError(new ConflictError("Já em uso."))).toEqual({ message: "Já em uso.", statusCode: 409, code: "CONFLICT" });
    expect(toHttpError(new ValidationError("Campo inválido."))).toEqual({
      message: "Campo inválido.",
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("subclasse arbitrária de AppError também é reconhecida (não só as exportadas)", () => {
    class MinhaExcecao extends AppError {
      constructor() {
        super("Erro customizado.", 418, "TEAPOT");
      }
    }
    expect(toHttpError(new MinhaExcecao())).toEqual({ message: "Erro customizado.", statusCode: 418, code: "TEAPOT" });
  });

  // Erros do Postgres via PostgREST/supabase-js chegam como
  // `{ message, details, hint, code }`, não como instância de Error — por
  // isso os testes abaixo usam objetos simples, igual o que really chega
  // num `catch` de repositório.
  describe("erros de constraint do Postgres (bug relatado: viravam 'Erro interno do servidor' genérico)", () => {
    it("23505 (unique_violation) — nome duplicado de categoria, valor único em geral", () => {
      const resultado = toHttpError({ code: "23505", message: "duplicate key value violates unique constraint" });
      expect(resultado.statusCode).toBe(409);
      expect(resultado.message).not.toBe("Erro interno do servidor.");
    });

    it("23503 (foreign_key_violation) — excluir cliente com orçamento vinculado", () => {
      const resultado = toHttpError({ code: "23503", message: "violates foreign key constraint" });
      expect(resultado.statusCode).toBe(409);
      expect(resultado.message).not.toBe("Erro interno do servidor.");
    });

    it("23502 (not_null_violation) e 23514 (check_violation) viram 400, não 500", () => {
      expect(toHttpError({ code: "23502" }).statusCode).toBe(400);
      expect(toHttpError({ code: "23514" }).statusCode).toBe(400);
    });
  });

  it("erro totalmente desconhecido (sem code reconhecido) continua caindo no 500 genérico", () => {
    const resultado = toHttpError(new Error("alguma falha inesperada"));
    expect(resultado.statusCode).toBe(500);
    expect(resultado.code).toBe("INTERNAL_ERROR");
  });

  it("valores não-Error (string, undefined, null) não quebram — caem no 500 genérico", () => {
    expect(toHttpError("string qualquer").statusCode).toBe(500);
    expect(toHttpError(undefined).statusCode).toBe(500);
    expect(toHttpError(null).statusCode).toBe(500);
  });
});
