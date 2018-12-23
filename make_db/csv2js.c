#include <stdlib.h>
#include <stdio.h>

int main(int argc, char *argv[]){
  //
  // usage: ./a.out <datafile> <headerfile>
  // datafile: raw csv file
  // headerfile: includes a id colume in the first column
  //    should includes \n
  // output: <datafile>.js
  //
  
  // 1. read csv recode from the file argv[1]
  FILE *fp = fopen(argv[1],"r");
  int lsize = 256;
  char line[lsize];

  // 2. prepend id sequence to each line and
  // save the result into the newfile
  int fsize = 64;
  int idsize = 12;
  char newfilename[fsize];
  sprintf(newfilename, "%s.csv", argv[1]);
  FILE *nfp = fopen(newfilename, "w");

  char lineout[lsize+idsize+2];
  int id = 0;

  while (fgets(line, lsize, fp) != NULL) {
    char *ptrl = line;
    char *ptrlo = lineout;
    char nbuf[idsize]; char *ptrb = nbuf; // for the id sequence
    id++;
    snprintf(nbuf, idsize, "%d", id);
    while (*ptrb != '\0') *ptrlo++ = *ptrb++; // prepend id sequence into lineout
    *ptrlo++ = ',';                           // add "," to lineout
    while (*ptrl != '\0') *ptrlo++ = *ptrl++; // append each line to the rest of lineout
    *ptrlo = '\0';
    fputs(lineout, nfp);
    }
  fclose(nfp);
  
  // 3. insert header stored in the file argv[2] into the top of the file argv[1]
  char command[fsize];
  sprintf(command, "cp %s ./tmp", argv[2]); system(command);
  sprintf(command, "cat %s.csv >> ./tmp", argv[1]); system(command);
  
  // 4.
  sprintf(command, "/Users/skybird/.nodebrew/current/bin/csvtojson ./tmp > ./tmp2");
  system(command);
  sprintf(command, "echo \"module.exports = {make: function (){return( \" > %s.js", argv[1]);
  system(command);
  sprintf(command, "cat ./tmp2 >> %s.js", argv[1]); system(command);
  sprintf(command, "echo \")}}\" >> %s.js", argv[1]); system(command);
  sprintf(command, "rm ./tmp"); system(command);
  sprintf(command, "rm ./tmp2"); system(command);

  return 0;
  }

