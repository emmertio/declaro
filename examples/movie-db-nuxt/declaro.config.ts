import { InterfaceModelGenerator, type StaticConfig } from '@declaro/build'
export default <StaticConfig>{
    models: {
        generators: [new InterfaceModelGenerator()],
    },
}
