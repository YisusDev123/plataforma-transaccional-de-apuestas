import { success } from "../../shared/utils/response.js";

export function iniciarSettingsController(settingsService) {
    return {
        async updateConfig(req, res, next) {
            try {
                const { key } = req.params;
                const newValue = req.body;

                const updatedRule = await settingsService.update(key, newValue);

                success(req, res, {
                    message: "Configuración actualizada. Todo el sistema ahora usa esta nueva regla.",
                    data: updatedRule
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async getRules(req, res, next) {
            try{
                const contenido = await settingsService.getAll()
                success(req, res, contenido, 200)
            }catch(error){
                next (error)
            }
        }
    };
}
