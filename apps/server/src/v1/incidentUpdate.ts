import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  incident,
  incidentStatus,
  incidentUpdate,
} from "@openstatus/db/src/schema";

import type { Variables } from ".";
import { ErrorSchema } from "./shared";

const incidenUpdateApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSelectSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the update",
      example: "1",
    }),
});

export const incidentUpdateSchema = z.object({
  status: z.enum(incidentStatus).openapi({
    description: "The status of the update",
  }),
  id: z.coerce.string().openapi({ description: "The id of the update" }),
  date: z
    .preprocess((val) => String(val), z.string())
    .openapi({
      description: "The date of the update in ISO 8601 format",
    }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});

const createIncidentUpdateSchema = z.object({
  incident_id: z.number().openapi({
    description: "The id of the incident",
  }),
  status: z.enum(incidentStatus).openapi({
    description: "The status of the update",
  }),
  date: z.string().datetime().openapi({
    description: "The date of the update in ISO 8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});
const getUpdateRoute = createRoute({
  method: "get",
  tags: ["incident_update"],
  path: "/:id",
  request: {
    params: ParamsSelectSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: incidentUpdateSchema,
        },
      },
      description: "Get all incidents",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

incidenUpdateApi.openapi(getUpdateRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const update = await db
    .select()
    .from(incidentUpdate)
    .where(eq(incidentUpdate.id, Number(id)))
    .get();

  if (!update) return c.jsonT({ code: 404, message: "Not Found" });

  const currentIncident = await db
    .select()
    .from(incident)
    .where(
      and(
        eq(incident.id, update.incidentId),
        eq(incident.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!currentIncident)
    return c.jsonT({ code: 401, message: "Not Authorized" });

  const data = incidentUpdateSchema.parse(update);

  return c.jsonT(data);
});

const createIncidentUpdate = createRoute({
  method: "post",
  tags: ["incident_update"],
  path: "/",
  request: {
    body: {
      description: "the incident update",
      content: {
        "application/json": {
          schema: createIncidentUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: incidentUpdateSchema,
        },
      },
      description: "Get all incidents",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

incidenUpdateApi.openapi(createIncidentUpdate, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const input = c.req.valid("json");

  const currentIncident = await db
    .select()
    .from(incident)
    .where(
      and(
        eq(incident.id, input.incident_id),
        eq(incident.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!currentIncident)
    return c.jsonT({ code: 401, message: "Not Authorized" });

  const res = await db
    .insert(incidentUpdate)
    .values({
      ...input,
      date: new Date(input.date),
      incidentId: input.incident_id,
    })
    .returning()
    .get();

  const data = incidentUpdateSchema.parse(res);
  return c.jsonT(data);
});

export { incidenUpdateApi };
