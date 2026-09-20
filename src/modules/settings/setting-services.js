import { settingsBodySchemas } from '../../schemas/setting-schema.js';

let memoryCache = {};

export function iniciarSettingsService(settingsSql) {
    return {
        async loadCache() {
            const rows = await settingsSql.getAllSettings();
            if(!rows){
                const error = new Error("ERROR AL OBTENER REGLAS DE NEGOCIO DE LA BASE DE DATOS ANTES DE CARGARLAS EN CACHE")
                error.statusCode = 400
                throw error
            }
            memoryCache = {};

            for (const row of rows) {
                const parsedValue = JSON.parse(row.setting_value);
                const schema = settingsBodySchemas[row.setting_key];
                const { error, value } = schema
                    ? schema.validate(parsedValue, { abortEarly: false, stripUnknown: true })
                    : { value: parsedValue };
                if (error) {
                    throw new Error(`La configuración persistida '${row.setting_key}' no cumple las reglas vigentes: ${error.message}`);
                }
                memoryCache[row.setting_key] = value;
            }
            console.log("⚙️ Reglas globales cargadas en memoria.");
        },

        get(key) {
            return memoryCache[key];
        },

        async update(key, jsonValue) {
            const currentValue = memoryCache[key] || {};

            const mergedValue = { ...currentValue, ...jsonValue };
            const schema = settingsBodySchemas[key];
            const { error: validationError, value: validatedValue } = schema.validate(mergedValue, {
                abortEarly: false,
                stripUnknown: true
            });
            if (validationError) {
                const error = new Error(`La configuración completa no es válida: ${validationError.message}`);
                error.statusCode = 400;
                throw error;
            }

            const valueString = JSON.stringify(validatedValue);

            try {
                const riskChanged = key === 'draw_defaults'
                    && jsonValue.default_risk_limit !== undefined
                    && Number(validatedValue.default_risk_limit) !== Number(currentValue.default_risk_limit);
                const closeChanged = key === 'draw_defaults'
                    && jsonValue.auto_close_minutes_before !== undefined
                    && Number(validatedValue.auto_close_minutes_before) !== Number(currentValue.auto_close_minutes_before);

                if (key === 'draw_defaults' && (riskChanged || closeChanged)) {

                    await settingsSql.updateDrawDefaultsConTransaccion(key, valueString, {
                        availableAmount: riskChanged ? validatedValue.default_risk_limit : undefined,
                        closeMinutes: closeChanged ? validatedValue.auto_close_minutes_before : undefined
                    });

                } else {
                    const actualizarRules = await settingsSql.updateSetting(key, valueString);
                    if (!actualizarRules) {
                        throw new Error("ERROR AL ACTUALIZAR REGLAS DE NEGOCIO");
                    }
                }

                memoryCache[key] = validatedValue;

                return memoryCache[key];

            } catch (error) {
                if (error.statusCode) throw error;
                const customError = new Error("No se pudo actualizar la configuración del sistema.");
                customError.statusCode = 500;
                throw customError;
            }
        },

        getAll() {
            return memoryCache;
        }
    };
}
