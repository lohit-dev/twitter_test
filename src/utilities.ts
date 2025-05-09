import fs from "fs";
import request from "request";

/**
 * Downloads a file from a URI to a local file
 * @param uri Source URI of the file
 * @param filename Destination filename
 * @param callback Function to call after download completes
 */
export function download(
  uri: string,
  filename: string,
  callback: () => void,
): void {
  request.head(uri, function (err, res, body) {
    request(uri).pipe(fs.createWriteStream(filename)).on("close", callback);
  });
}
