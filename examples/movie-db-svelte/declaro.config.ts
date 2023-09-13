import { ClassModelGenerator, StaticConfig } from '@declaro/build';
export default <StaticConfig>{
	models: {
		generators: [new ClassModelGenerator()]
	}
};
