import express from 'express';
import cors from "cors";
import bodyParser from "body-parser";
import apiRoutes from './routes/index.js';
const app=express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));//
//app.use(express.text({ type: '*/*' }));
app.use(bodyParser.json());
app.use(async (err, req, res, next) => {

    if (err instanceof SyntaxError && 'body' in err) {
        console.error(err);
        return errorRes(res, 'Bad request', HttpStatusCode.BAD_REQUEST) // Bad request
    }

    next();
    // throw err;
});

process.on('uncaughtException', (reason, req, res) => {
    console.log('uncaughtException');
    const response = {
        status: false,
        message: "Something went worng. Please try again.",
        error: reason
    }
    console.info(reason);
    process.exit(1);
});

// get the unhandled rejection and throw it to another fallback handler we already have.
process.on('unhandledRejection', (reason, req, res) => {
    console.log('unhandledRejection');
    const response = {
        status: false,
        message: "Something went worng. Please try again.",
        error: reason
    }
    throw reason;
});
app.use('/api/v1/', apiRoutes);
app.use('/', (req, res, next) => {    
    res.send('' + Date.now());
});
// routes end

// no route found start
app.use((req, res, next) => {
    const response = {
        status: false,
        message: "Page not found on the server"
    }
    errorRes(res, response.message, HttpStatusCode.NOT_FOUND);
});
app.listen(8080, () => {
       // registerSQSSubscriber.activateAfter10Sc();
        console.log(`server started at http://:${8080}`);
});