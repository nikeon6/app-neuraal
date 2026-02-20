export const LOGO_CID = "logo@neuraal.app";

/**
 * Wraps email body content in a valid HTML document so email
 * clients (especially Gmail) treat it as well-formed.
 */
export function buildEmailDocument(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;">
${bodyContent}
</body>
</html>`;
}
