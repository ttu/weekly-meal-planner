import * as ImagePicker from 'expo-image-picker'

export type PickedImage = { readonly uri: string; readonly contentType: string }

/** Injected into the editor so a test can answer without a device dialog. */
export type PickPhoto = () => Promise<PickedImage | undefined>

/**
 * The device's own picker — a file dialog on the web, the photo library on a
 * phone. Resized on the way out: a modern phone camera produces several
 * megabytes, the card shows a 46px chip, and the bucket refuses anything over
 * five.
 */
export const pickPhotoFromLibrary: PickPhoto = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  })

  const asset = result.canceled ? undefined : result.assets[0]
  if (asset === undefined) return undefined

  return { uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' }
}
