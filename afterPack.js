exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'win32') {
    context.packager.executableName = 'weavegraph'
  }
};