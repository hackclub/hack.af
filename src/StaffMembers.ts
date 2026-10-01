const isStaffMember = async (userId: string) => {
  const allowedUsers = new Set([
    "U04QH1TTMBP", // graham
    "U0C7B14Q3", // max
    "U0266FRGP", // zrl
    "U032A2PMSE9", // kara
    "USNPNJXNX", // sam
    "U022XFD2TML", // ian
    "U013B6CPV62", // caleb
    "U014E8132DB", // shubham panth
    "U03DFNYGPCN", // MR. MALTED WHEATIES ESQ.
    "U02CWS020SD", // ALEX AKA ICE SPICE 2
    "U02UYFZQ0G0", // cheru :O
    "U041FQB8VK2", // thomas
    "U01MPHKFZ7S", // Arv
    "U0161JDSHGR", // sarthak
    "U04MDFEBL2U", // alex s
    "U019PF0KNE6", // belle
    "U045B4BQ2T0", // dieter
    "U04BBP8H9FA", // shawn
    "UN79ZPYMQ", // gary
    "U014ND5P1N2", // fayd
    "U02C9DQ7ZL2", // toby
    "U05NX48GL3T", // jasperrrrrrr
    "U04GECG3H8W", // rhys
    "U022FMN61SB", // leo
    "U029D5FG8EN", // shubham patil
    "U06QK6AG3RD", // nora :3
    "U0409FSKU82", // Arpan
    "U03K9LZ3AE6", // shayaan
    "U05C64XMMHV", // Micha,
    "U0261EB1EG7", // Deven
    "U054VC2KM9P", // amber :)
    "U07BLJ1MBEE", // leow@hackclub.com
    "U062UG485EE", // kieran
    "U01G0Q9K998", // lux
    "U0641AYUJ91", // adam :P
    "U08B2HD1JNA", // phoebe
    "U079FFTKM37", // zenab
    "U056J6JURFF", // sofia
    "U05D1G4H754", // evan
    "U01581HFAGZ", // alex p
    "U078J6H1XL3", // phthallo
    "U03UBRVG2MS", // sam liu
    "U07FCRNHS1J", // augie
    "U06P62WGWAV", // meghana
    "U05UQ2RTJ6T", // mohamad
    "UR83LFD36", // anish
    "U04QD71QWS0", // Manitej
    "U07UBCSSQH3", // leafd
    "U075RTSLDQ8", // Angad
    "U078DFX40A2", //Emma
    "U05JNJZJ0BS", // CAN
    "U085US8GYG6", // Shaan :)
    "U01PJ08PR7S", // Josias
    "U07UV4R2G4T", // Ivie :3
    "U06PR6B8D37", // @alexren
    "U07ACECRYM6", // renran sun
    "U0926UASBJ7", // Jenin
    "U07DPHQCCCS", // Matthew
    "U07DJMFAQQP", // Tongyu
    "U05F4B48GBF", // @cskartikey
    "U080A3QP42C", // Rowan
    "U06U80G86H1", // Reem
    "U05EZRFKRV4", // Nathan
    "U082DPCGPST", // ascerton pixi the third (@ascpixi)
    "U0824G9PTFE", // dhyan
    "U07HEH4N8UV", // @jps
    "U093AJCBP0C", // Alfie
    "U094X8Y4MMG", // willsbuilds
    "U08RVF1BAN4", // barnav
    "U08QMC72ZST", // kaylee dinh
    "U06SQJ508LF", // katie su
    "U08CJCZ2Z9S", // jolly wang
    "U07GLQY6UN4", // daamin
    "U078VN0UU2K", // freddie
    "U09AYT4B1JB", // wally
    "U07ULNFPQ4T", // lynn
  ]);
  return allowedUsers.has(userId);
};

export default isStaffMember;