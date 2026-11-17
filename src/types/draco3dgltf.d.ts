declare module "draco3dgltf" {
  interface DracoBrowserModule {
    createDecoderModule(): Promise<unknown>;
    createEncoderModule(): Promise<unknown>;
  }

  const draco3d: DracoBrowserModule;
  export default draco3d;
}
