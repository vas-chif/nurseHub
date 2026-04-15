function Macrosenzatitolo() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getRange('C9:AM43').activate();
  spreadsheet.getActiveRangeList().setHorizontalAlignment('center').setVerticalAlignment('middle');
}
