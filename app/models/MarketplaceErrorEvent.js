"use strict";
import { Model, DataTypes, QueryTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceErrorEvent extends Model {
  static associate(models) {
    MarketplaceErrorEvent.belongsTo(models.User, {
      foreignKey: "last_user_id",
      as: "LastUser",
    });
  }

  static async upsertFromReport(payload) {
    const p = payload || {};

    if (!sequelize?.query) return;

    const fingerprint = p.fingerprint != null ? String(p.fingerprint) : null;
    if (!fingerprint) return;

    const route = p.route != null ? String(p.route) : null;
    const method = p.method != null ? String(p.method) : null;
    const status = p.status != null ? Number(p.status) : null;
    const errorName = p.errorName != null ? String(p.errorName) : null;
    const pgCode = p.pgCode != null ? String(p.pgCode) : null;
    const constraintName = p.constraintName != null ? String(p.constraintName) : null;
    const message = p.message != null ? String(p.message) : null;
    const stack = p.stack != null ? String(p.stack) : null;
    const contextJson = p.contextJson != null ? String(p.contextJson) : null;
    const requestId = p.requestId != null ? String(p.requestId) : null;
    const userId = p.userId != null ? String(p.userId) : null;

    const withStatementTimeout = async (timeoutMs, fn) => {
      const ms = Number(timeoutMs);
      if (!Number.isFinite(ms) || ms <= 0) return await fn(null);
      if (!sequelize?.transaction) return await fn(null);

      return await sequelize.transaction(async (transaction) => {
        await sequelize.query("SET LOCAL statement_timeout = :timeout", {
          transaction,
          replacements: { timeout: Math.floor(ms) },
          type: QueryTypes.RAW,
        });
        return await fn(transaction);
      });
    };

    await withStatementTimeout(250, async (transaction) => {
      await sequelize.query(
        `INSERT INTO public.marketplace_error_events
          (fingerprint, route, method, status, error_name, pg_code, constraint_name, sample_message, sample_stack, sample_context, last_request_id, last_user_id)
         VALUES
          (:fingerprint, :route, :method, :status, :errorName, :pgCode, :constraintName, :message, :stack, :context::jsonb, :requestId, :userId::uuid)
         ON CONFLICT (fingerprint)
         DO UPDATE SET
          last_seen_at = now(),
          event_count = public.marketplace_error_events.event_count + 1,
          route = COALESCE(EXCLUDED.route, public.marketplace_error_events.route),
          method = COALESCE(EXCLUDED.method, public.marketplace_error_events.method),
          status = COALESCE(EXCLUDED.status, public.marketplace_error_events.status),
          error_name = COALESCE(EXCLUDED.error_name, public.marketplace_error_events.error_name),
          pg_code = COALESCE(EXCLUDED.pg_code, public.marketplace_error_events.pg_code),
          constraint_name = COALESCE(EXCLUDED.constraint_name, public.marketplace_error_events.constraint_name),
          sample_message = EXCLUDED.sample_message,
          sample_stack = EXCLUDED.sample_stack,
          sample_context = EXCLUDED.sample_context,
          last_request_id = EXCLUDED.last_request_id,
          last_user_id = EXCLUDED.last_user_id`,
        {
          transaction,
          replacements: {
            fingerprint,
            route,
            method,
            status,
            errorName,
            pgCode,
            constraintName,
            message,
            stack,
            context: contextJson,
            requestId,
            userId,
          },
          type: QueryTypes.RAW,
        }
      );
    });
  }
}

MarketplaceErrorEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    fingerprint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    first_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    event_count: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 1,
    },
    route: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    method: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    error_name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pg_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    constraint_name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sample_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sample_stack: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sample_context: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    last_request_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "MarketplaceErrorEvent",
    tableName: "marketplace_error_events",
    timestamps: false,
  }
);

export default MarketplaceErrorEvent;
