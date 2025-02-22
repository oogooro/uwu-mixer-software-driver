declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DEBUG_MODE?: '1' | '0';
            ENV: 'prod' | 'dev';
        }
    }
}

export { };