"use strict";

const pluginPkg = require("../package.json");
const PERMISSIONS = require("../constants/permissions");
const JSZip = require("jszip");
const mimeExtension = require("../services/utils/mimeExtension");
const PLUGIN_ID = pluginPkg.name.replace(/^strapi-plugin-/i, "");


function getService(service = PLUGIN_ID) {
  const SERVICES = strapi.plugins[PLUGIN_ID].services;
  return SERVICES[service];
}

/**
 * import-export-content.js controller
 *
 * @description: A set of functions called "actions" of the `import-export-content` plugin.
 */

module.exports = {
  /**
   * Default action.
   *
   * @return {Object}
   */

  index: async (ctx) => {
    ctx.send({ message: "ok" }); // Send 200 `ok`
  },

  preAnalyzeContent: async (ctx) => {
    const { data, type } = ctx.request.body;
    if (!data || !type) {
      return ctx.throw(400, "Required parameters missing");
    }

    try {
      const service = getService();
      const data = await service.preAnalyzeContent(ctx);
      ctx.send({ data, message: "ok" });
    } catch (error) {
      console.error(error);
      ctx.throw(406, `could not parse: ${error}`);
    }
  },

  importItems: async (ctx) => {
    const { target, fields, items } = ctx.request.body;

    if (!target || !fields || !items) {
      return ctx.throw(400, "Required parameters missing");
    }

    const { userAbility } = ctx.state;
    if (
      userAbility.cannot(PERMISSIONS.create, target.uid) &&
      userAbility.cannot(PERMISSIONS.update, target.uid)
    ) {
      return ctx.forbidden();
    }

    try {
      const service = getService();
      const results = await service.importItems(ctx);
      const succesfully = results.every((res) => res);
      ctx.send({
        succesfully,
        message: succesfully
          ? "All Data Imported"
          : results.some((res) => res)
            ? "Some Items Imported"
            : "No Items Imported",
      });
    } catch (error) {
      console.error(error);
      ctx.throw(406, `could not parse: ${error}`);
    }
  },

  exportItems: async (ctx) => {
    const { target, type, options } = ctx.request.body;

    if (!target || !type || !options) {
      return ctx.throw(400, "Required parameters missing");
    }

    const { userAbility } = ctx.state;
    if (userAbility.cannot(PERMISSIONS.read, target.uid)) {
      return ctx.forbidden();
    }

    try {
      const service = getService();
      const data = await service.exportItems({
        target,
        type,
        options,
      }, ctx);
      ctx.send({ data, message: "ok" });
    } catch (error) {
      console.error(error);
      ctx.throw(406, `could not parse: ${error}`);
    }
  },

  exportItemsMulti: async (ctx) => {
    const { targets, type, options } = JSON.parse(ctx.request.body);

    if (!targets || !type || !options) {
      return ctx.throw(400, "Required parameters missing");
    }

    const { userAbility } = ctx.state;

    try {
      const zip = new JSZip();

      const createOperation = async (target) => {
        const data = await getService().exportItems({
          target,
          options,
          type,
        }, ctx);

        zip.file(`${target.info.name}.${mimeExtension(type)}`, data);
      }

      for (const target of targets) {
        if (userAbility.cannot(PERMISSIONS.read, target.uid)) {
          return ctx.forbidden();
        }
      }

      await Promise.all(targets.map(createOperation));

      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      ctx.send(buffer);
    } catch (error) {
      console.error(error);
      ctx.throw(406, `could not parse: ${error}`);
    }
  },
};
