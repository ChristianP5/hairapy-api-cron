const Hapi = require('@hapi/hapi');
const { Firestore } = require('@google-cloud/firestore');

const convertDatetoSec = (isoDate) => {
    // Parse the ISO date string into a Date object
    const date = new Date(isoDate);
    // Get the timestamp in milliseconds and convert it to seconds
    const seconds = Math.floor(date.getTime() / 1000);
    return seconds;
};

const init = async () => {
    const server = Hapi.server({
        port: 9000,
        host: 'localhost',
    })

    server.ext('onPreResponse', (request, h) => {
        const response = request.response;

        if(response instanceof Error){
            const newResponse = h.response({
                status: 'fail',
                message: response.message,
                error: response.stack,
            })

            newResponse.code(response.output.statusCode);

            return newResponse;
        }

        return h.continue;
    })

    server.route([
        {
            path: '/refreshTokens',
            method: 'DELETE',
            handler: async (request, h) => {

                const fs = new Firestore({
                    projectId: 'hairapy',
                    databaseId: 'hairapy-firestore',
                })

                /*
                    1) Get all RefreshTokens
                    2) Delete RefreshTokens thats 2 or more days old 
                */

                // 1)
                const rtCollection = fs.collection('refreshTokens');

                const result = await rtCollection.get();

                // 2)
                const DAY_IN_SEC = 86400;
                const currentDate = new Date().toISOString();
                const currentDateSec = convertDatetoSec(currentDate);

                const batch = fs.batch();
                let count = 0;
                result.forEach(doc=>{
                    const data = doc.data();
                    const date = data.createdAt;

                    const dateSec = convertDatetoSec(date);
                    if(currentDateSec - dateSec >= DAY_IN_SEC*1){
                        batch.delete(doc.ref);
                        count+=1;
                    }
                })

                await batch.commit();

                const response = h.response({
                    status: 'success',
                    message: `${count} responseTokens deleted successfully.`
                })

                response.code(200);

                return response;
            }
        }
    ])

    await server.start();
    console.log(`Server started at ${server.info.uri}`);
}

process.on('unhandledRejection', (error)=>{
    console.error(error.stack);
    process.exit(1);
})

init();