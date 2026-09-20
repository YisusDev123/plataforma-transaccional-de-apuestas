export function success(req, res, mensaje, status){
    const mensajeOk = mensaje || ""
    const statusOk = status || ""
    res.status(statusOk).send({
        error: false,
        status: statusOk,
        body: mensajeOk
    })
}
