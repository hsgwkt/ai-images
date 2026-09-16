async function directory() {
  return navigator.storage.getDirectory()
}

export async function writeFile(fileName: string, file: Blob) {
  const dir = await directory()
  const handle = await dir.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(file)
  await writable.close()
}

export async function readFile(fileName: string): Promise<File | null> {
  try {
    const dir = await directory()
    const handle = await dir.getFileHandle(fileName)
    return await handle.getFile()
  } catch {
    return null
  }
}

export async function readTextFile(fileName: string): Promise<string> {
  const file = await readFile(fileName)
  const text = await file?.text()
  return text ?? ''
}
