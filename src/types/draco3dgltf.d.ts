declare module "draco3dgltf" {
  interface DracoModuleOptions {
    locateFile?: (filename: string) => string;
  }

  interface DracoBrowserModule {
    createDecoderModule(options?: DracoModuleOptions): Promise<unknown>;
    createEncoderModule(options?: DracoModuleOptions): Promise<unknown>;
  }

  const draco3d: DracoBrowserModule;
  export default draco3d;
}
