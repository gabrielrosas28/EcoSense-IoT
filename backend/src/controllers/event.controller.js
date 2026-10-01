import * as eventService from "../services/event.service.js";

export async function list(req, res) {
  res.json(await eventService.listEvents(req.validated.query));
}
