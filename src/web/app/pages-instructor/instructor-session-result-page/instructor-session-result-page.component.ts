import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import moment from 'moment-timezone';
import { Observable } from 'rxjs';
import { HttpRequestService } from '../../../services/http-request.service';
import { StatusMessageService } from '../../../services/status-message.service';
import { TimezoneService } from '../../../services/timezone.service';
import {
  FeedbackSession, FeedbackSessionPublishStatus, FeedbackSessionSubmittedGiverSet,
  SessionResults, Student, Students,
} from '../../../types/api-output';
import { Intent } from '../../../types/api-request';
// tslint:disable-next-line:max-line-length
import { ConfirmPublishingSessionModalComponent } from '../../components/sessions-table/confirm-publishing-session-modal/confirm-publishing-session-modal.component';
// tslint:disable-next-line:max-line-length
import { ConfirmUnpublishingSessionModalComponent } from '../../components/sessions-table/confirm-unpublishing-session-modal/confirm-unpublishing-session-modal.component';
import { ErrorMessageOutput } from '../../error-message-output';
import { InstructorSessionResultSectionType } from './instructor-session-result-section-type.enum';

/**
 * Instructor feedback session result page.
 */
@Component({
  selector: 'tm-instructor-session-result-page',
  templateUrl: './instructor-session-result-page.component.html',
  styleUrls: ['./instructor-session-result-page.component.scss'],
})
export class InstructorSessionResultPageComponent implements OnInit {

  // enum
  InstructorSessionResultSectionType: typeof InstructorSessionResultSectionType = InstructorSessionResultSectionType;

  session: any = {};
  formattedSessionOpeningTime: string = '';
  formattedSessionClosingTime: string = '';
  viewType: string = 'QUESTION';
  section: string = '';
  sectionType: InstructorSessionResultSectionType = InstructorSessionResultSectionType.EITHER;
  groupByTeam: boolean = true;
  showStatistics: boolean = true;
  indicateMissingResponses: boolean = true;

  sectionsModel: { [key: string]: any } = {};
  isSectionsLoaded: boolean = false;
  questionsModel: { [key: string]: any } = {};
  isQuestionsLoaded: boolean = false;
  noResponseStudents: Student[] = [];
  isNoResponsePanelLoaded: boolean = false;
  FeedbackSessionPublishStatus: typeof FeedbackSessionPublishStatus = FeedbackSessionPublishStatus;

  constructor(private httpRequestService: HttpRequestService, private route: ActivatedRoute,
      private timezoneService: TimezoneService, private statusMessageService: StatusMessageService,
      private modalService: NgbModal, private router: Router) {
    this.timezoneService.getTzVersion(); // import timezone service to load timezone data
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((queryParams: any) => {
      const paramMap: { [key: string]: string } = {
        courseid: queryParams.courseid,
        fsname: queryParams.fsname,
        intent: Intent.INSTRUCTOR_RESULT,
      };
      this.httpRequestService.get('/session', paramMap).subscribe((resp: FeedbackSession) => {
        const TIME_FORMAT: string = 'ddd, DD MMM, YYYY, hh:mm A zz';
        this.session = resp;
        this.formattedSessionOpeningTime =
            moment(this.session.submissionStartTimestamp).tz(this.session.timeZone).format(TIME_FORMAT);
        this.formattedSessionClosingTime =
            moment(this.session.submissionEndTimestamp).tz(this.session.timeZone).format(TIME_FORMAT);

        const sectionsParamMap: { [key: string]: string } = {
          courseid: queryParams.courseid,
        };
        this.httpRequestService.get('/course/sections', sectionsParamMap).subscribe((resp2: any) => {
          for (const sectionName of resp2.sectionNames) {
            this.sectionsModel[sectionName] = {
              responses: [],
              hasPopulated: false,
            };
          }
          this.isSectionsLoaded = true;
        }, (resp2: any) => {
          this.statusMessageService.showErrorMessage(resp2.error.message);
        });

        this.httpRequestService.get('/questions', paramMap).subscribe((resp2: any) => {
          for (const question of resp2.questions) {
            question.responses = [];
            question.hasPopulated = false;
            this.questionsModel[question.feedbackQuestionId] = question;
          }
          this.isQuestionsLoaded = true;
        }, (resp2: any) => {
          this.statusMessageService.showErrorMessage(resp2.error.message);
        });

        this.httpRequestService.get('/students', paramMap).subscribe((allStudents: Students) => {
          const students: Student[] = allStudents.students;

          this.httpRequestService
              .get('/session/submitted/giverset', paramMap)
              .subscribe((feedbackSessionSubmittedGiverSet: FeedbackSessionSubmittedGiverSet) => {
                this.noResponseStudents = students.filter((student: Student) =>
                                            !feedbackSessionSubmittedGiverSet.giverIdentifiers.includes(student.email));
              }, (resp4: any) => {
                this.statusMessageService.showErrorMessage(resp4.error.message);
              });

          this.isNoResponsePanelLoaded = true;
        }, (resp3: any) => {
          this.statusMessageService.showErrorMessage(resp3.error.message);
        });

      }, (resp: ErrorMessageOutput) => {
        this.statusMessageService.showErrorMessage(resp.error.message);
      });
    });
  }

  /**
   * Loads all the responses and response statistics for the specified question.
   */
  loadQuestion(questionId: string): void {
    if (this.questionsModel[questionId].hasPopulated) {
      // Do not re-fetch data
      return;
    }
    const paramMap: { [key: string]: string } = {
      courseid: this.session.courseId,
      fsname: this.session.feedbackSessionName,
      questionid: questionId,
      intent: Intent.INSTRUCTOR_RESULT,
    };
    this.httpRequestService.get('/result', paramMap).subscribe((resp: SessionResults) => {
      if (resp.questions.length) {
        const responses: any = resp.questions[0];
        this.questionsModel[questionId].responses = responses.allResponses;
        this.questionsModel[questionId].statistics = responses.questionStatistics;
        this.questionsModel[questionId].hasPopulated = true;
      }
    }, (resp: ErrorMessageOutput) => {
      this.statusMessageService.showErrorMessage(resp.error.message);
    });
  }

  /**
   * Loads all the responses and response statistics for the specified section.
   */
  loadSection(sectionName: string): void {
    if (this.sectionsModel[sectionName].hasPopulated) {
      // Do not re-fetch data
      return;
    }
    const paramMap: { [key: string]: string } = {
      courseid: this.session.courseId,
      fsname: this.session.feedbackSessionName,
      frgroupbysection: sectionName,
      intent: Intent.INSTRUCTOR_RESULT,
    };
    this.httpRequestService.get('/result', paramMap).subscribe((resp: SessionResults) => {
      this.sectionsModel[sectionName].questions = resp.questions;
      this.sectionsModel[sectionName].hasPopulated = true;
    }, (resp: ErrorMessageOutput) => {
      this.statusMessageService.showErrorMessage(resp.error.message);
    });
  }

  /**
   * Handle publish result button event.
   */
  publishResultHandler(): void {
    const isPublished: boolean = this.session.publishStatus === FeedbackSessionPublishStatus.PUBLISHED;
    const publishResultEndPoint: string = '/session/publish';
    const modalRef: NgbModalRef = this.modalService.open(isPublished ? ConfirmUnpublishingSessionModalComponent :
        ConfirmPublishingSessionModalComponent);
    modalRef.componentInstance.feedbackSessionName = this.session.feedbackSessionName;

    modalRef.result.then(() => {
      const paramsMap: { [key: string]: string } = {
        courseid: this.session.courseId,
        fsname: this.session.feedbackSessionName,
      };

      const response: Observable<any> = isPublished ? this.httpRequestService.delete(publishResultEndPoint, paramsMap) :
          this.httpRequestService.post(publishResultEndPoint, paramsMap);

      response.subscribe(() => {
        this.router.navigateByUrl('/web/instructor/sessions');
      }, (resp: ErrorMessageOutput) => {
        this.statusMessageService.showErrorMessage(resp.error.message);
      });
    }, () => {});
  }
}
