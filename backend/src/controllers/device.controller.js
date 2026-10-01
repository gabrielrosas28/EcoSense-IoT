import * as deviceService from "../services/device.service.js";

export async function list(_req, res) {
  res.json(await deviceService.listDevices());
}

export async function show(req, res) {
  res.json(await deviceService.getDevice(req.validated.params.id));
}

/** 202: o comando foi aceito; quem confirma a execução é o dispositivo. */
export async function command(req, res) {
  const result = await deviceService.sendCommand(req.validated.params.id, req.validated.body);
  res.status(202).json(result);
}
